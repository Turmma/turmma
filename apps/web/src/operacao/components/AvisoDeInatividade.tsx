import { createContext, useContext } from 'react'
import { Button } from '../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'

/**
 * O aviso de inatividade da sessão com a tela aberta, e o que a casca precisa saber dos diálogos. Um `dialog` modal deixa
 * inerte tudo fora dele: o aviso desenhado na casca ficaria sem foco, sem clique e fora da árvore de acessibilidade, e o
 * operador parado com o Nova escola aberto perderia a sessão sem ter como continuar (D59; WCAG 2.2.1). Por isso, com um
 * diálogo aberto, o aviso sai da casca e é desenhado **dentro** do diálogo.
 */
export interface SessionWarningContextValue {
  readonly visivel: boolean
  readonly continuar: () => void
  readonly sair: () => void
  /** O diálogo que abre se registra, e o cancelamento que isto devolve o tira da conta ao fechar. */
  readonly registrarDialogo: () => () => void
}

export const SessionWarningContext = createContext<SessionWarningContextValue | undefined>(undefined)

/**
 * O aviso 2 min antes do fim da sessão parada (Tech Spec da A0, seção 9). Não é diálogo: não rouba o foco de quem
 * voltou à tela, e é anunciado pelo `role="alert"`. "Continuar" e "Sair" do mesmo tamanho (D59).
 */
export function AvisoDeInatividade({ aoContinuar, aoSair }: { aoContinuar: () => void; aoSair: () => void }) {
  return (
    <section aria-label="Aviso de inatividade" className="fixed inset-x-0 bottom-0 z-10 border-t border-pendente bg-pendente-cx">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p role="alert" className="text-pendente">
          Sua sessão vai terminar em 2 minutos por falta de uso.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={aoContinuar}>Continuar na sessão</Button>
          <button type="button" onClick={aoSair} className={SECONDARY_BUTTON_CLASSES}>
            Sair
          </button>
        </div>
      </div>
    </section>
  )
}

/** O aviso dentro de um diálogo aberto, quando a sessão está para terminar. Fora da casca com sessão, nada. */
export function AvisoNoDialogo() {
  const aviso = useContext(SessionWarningContext)
  if (aviso?.visivel !== true) return null
  return <AvisoDeInatividade aoContinuar={aviso.continuar} aoSair={aviso.sair} />
}
