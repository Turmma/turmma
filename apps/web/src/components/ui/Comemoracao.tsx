import type { Agente } from '@educa/shared'
import type { ReactNode } from 'react'
import { Onca } from './onca/Onca'

interface PropsDaComemoracao {
  readonly agente: Agente
  /** O que se diz ao lado da onça, uma frase de quem escreve a tela: o fato ("Atividade enviada"), nunca sentimento nem número. */
  readonly children?: ReactNode
}

/**
 * A comemoração do envio (RF8, RF19; `docs/interface.md` 9.7; D59): a onça `comemorando`, assinada pela função e com o
 * selo "IA", dando **um salto** ao aparecer: o da pose `comemorando` da própria `Onca` (`onca/Onca.css`, `onca-comemora`, 500 ms,
 * uma iteração). É o único movimento da árvore: a peça não põe outro por cima. Quem a monta é a tarefa aberta, e só depois de o envio
 * ter sido confirmado nesta tela: não depende de acerto, de resultado nem de tempo de uso, e não volta ao recarregar.
 *
 * Sem som, sem número, sem pontos, sem temporizador: o salto é do CSS, uma iteração, e some com "reduzir movimento". É a
 * única peça que desenha a pose `comemorando`, e só `areas/aluno/Atividade.tsx` a importa, fora a seção
 * `gallery/sections/introducao.tsx`, que a mostra para o e2e (`ia/avatar-so-nas-duas-pecas.test.ts`).
 */
export function Comemoracao({ agente, children }: PropsDaComemoracao) {
  return (
    <div data-comemoracao="" className="flex min-w-0 flex-col items-center gap-3 text-center">
      <Onca pose="comemorando" agente={agente} tamanho={120} />
      {children !== undefined && <p className="t-corpo min-w-0 break-words text-tinta">{children}</p>}
    </div>
  )
}
