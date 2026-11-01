import { createContext, Suspense, useCallback, useContext, useRef, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { Tabs, type TabItem } from '../../../components/ui/Tabs'
import { EstadoCarregando } from '../../../components/states/index'
import { Page } from '../../../components/ui/Page'
import { useTituloDaTela } from '../../../document-title'
import { O_MIOLO_QUE_ROLA } from './miolo-que-rola'

/** Uma aba de moldura: o que o `Tabs` pede, mais o endereço **de hoje** dela, relativo à área. */
export interface AbaDaMoldura extends TabItem {
  readonly caminho: string
}

/**
 * Quem leva o foco ao título da moldura (o `h1` "Escola" ou "Registros"). A tela de dentro perdeu a `Page` dela, e o `h1` onde
 * o foco cai quando o botão que abriu um diálogo saiu da tela (`Professores`) é o da moldura.
 */
const ContextoDoTituloDaMoldura = createContext<(() => void) | undefined>(undefined)

/** O foco no título da moldura em que a tela está. Fora de uma moldura (a tela sozinha, num teste) não faz nada. */
export function useFocarOTituloDaMoldura(): () => void {
  return useContext(ContextoDoTituloDaMoldura) ?? semMoldura
}
function semMoldura(): void {
  return undefined
}

interface Props {
  /** O `h1` da moldura: "Escola" ou "Registros". */
  readonly titulo: string
  /** A aba do navegador: "Escola: turmas", "Registros: IA". */
  readonly tituloDaAba: string
  /** O nome da lista de abas para o leitor de tela. */
  readonly rotuloDasAbas: string
  readonly abas: readonly AbaDaMoldura[]
  /** O `id` da aba do endereço. */
  readonly ativa: string
  readonly children: ReactNode
}

/**
 * A moldura de um lugar que tem abas (D80; Tech Spec da X2, seção 9, "Molduras"): o `Page` com o título do lugar, as `Tabs` com
 * a do endereço e, dentro, a tela que já existia, sem a `Page` dela. **A aba é o endereço**: trocar de aba navega para o
 * endereço de hoje daquela tela, e o `routes.tsx` é quem diz qual aba é a de cada endereço. A moldura não lê consulta nenhuma e
 * não sabe o que há dentro.
 *
 * - **Um `h1` só**, o da moldura, que recebe o foco (`tabIndex={-1}`) quando a tela de dentro pede (`useFocarOTituloDaMoldura`).
 * - **A tela de dentro é `lazy()`**: o `Suspense` é daqui, para a moldura e as abas ficarem na tela enquanto o pedaço chega.
 * - **Só o miolo rola** a partir de 768 px, numa região com nome e `tabIndex={0}` (o painel da aba).
 */
export function Moldura({ titulo, tituloDaAba, rotuloDasAbas, abas, ativa, children }: Props) {
  useTituloDaTela(tituloDaAba)
  const [, navegar] = useLocation()
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const focarOTitulo = useCallback(() => tituloRef.current?.focus(), [])

  return (
    <ContextoDoTituloDaMoldura value={focarOTitulo}>
      <Page titulo={titulo} refDoTitulo={tituloRef}>
        <Tabs
          rotulo={rotuloDasAbas}
          abas={abas}
          ativa={ativa}
          aoMudar={(id) => {
            const aba = abas.find((candidata) => candidata.id === id)
            if (aba !== undefined) navegar(aba.caminho)
          }}
          classeDoPainel={O_MIOLO_QUE_ROLA}
        >
          <Suspense key={ativa} fallback={<EstadoCarregando rotulo="Carregando…" />}>{children}</Suspense>
        </Tabs>
      </Page>
    </ContextoDoTituloDaMoldura>
  )
}
