import { useSyncExternalStore } from 'react'
import { aoTrocarDeSessao } from './sessao'

/**
 * O que a tela precisa lembrar **entre duas rotas** e que não é dado de servidor: o pedido que acabou de sair da Home e
 * ainda está sendo respondido quando a Conversa abre, a turma escolhida na caixa de pedido. Não cabe em `useState`, que
 * morre com a tela, nem no cache de consultas, que é do que a API devolveu (regra 50, item 3).
 *
 * **Só em memória, e some com a sessão**: nada disto vai a `localStorage` nem ao endereço (regra 50, item 7), e toda
 * sessão que acaba ou muda de dono esvazia tudo, como o cache de consultas (`main.tsx`). No Chromebook do carrinho, a
 * pessoa seguinte não encontra o pedido da anterior.
 */
export interface LugarNaAba<T> {
  readonly ler: () => T | undefined
  readonly guardar: (valor: T | undefined) => void
  readonly assinar: (ouvinte: () => void) => () => void
}

const esvaziar = new Set<() => void>()

aoTrocarDeSessao(() => {
  for (const limpar of esvaziar) limpar()
})

/** Um lugar na memória da aba, com o tipo do que guarda. Criado uma vez, no módulo de quem usa. */
export function criarLugarNaAba<T>(): LugarNaAba<T> {
  let valor: T | undefined
  const ouvintes = new Set<() => void>()
  const guardar = (novo: T | undefined): void => {
    if (Object.is(novo, valor)) return
    valor = novo
    for (const ouvinte of ouvintes) ouvinte()
  }
  esvaziar.add(() => guardar(undefined))
  return {
    ler: () => valor,
    guardar,
    assinar: (ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
  }
}

/** O que está guardado no lugar, com a tela refeita quando ele muda. */
export function useLugarNaAba<T>(lugar: LugarNaAba<T>): T | undefined {
  return useSyncExternalStore(lugar.assinar, lugar.ler)
}
